// Compass Guide — Claude API Serverless Function
// Vercel serverless function: /api/generate

module.exports = async function handler(req, res) {
  // CORS headers (needed for local testing)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in environment' });

  const answers = req.body;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(answers) }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return res.status(500).json({ error: 'Claude API error', status: response.status });
    }

    const data = await response.json();
    const rawText = data.content[0].text;

    // Strip markdown code blocks if present
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', rawText.substring(0, 200));
      return res.status(500).json({ error: 'Could not parse roadmap JSON from Claude response' });
    }

    const roadmap = JSON.parse(jsonMatch[0]);
    return res.status(200).json(roadmap);

  } catch (err) {
    console.error('Generate handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};

function buildPrompt(a) {
  const gradeNum = parseInt(a.grade) || 9;
  const yearsRemaining = Math.max(12 - gradeNum + 1, 1);
  const name = a.name || 'the student';
  const track = a.track || 'STEM Research';

  return `You are a college readiness expert for first-generation and immigrant families in the United States. Generate a personalized 6-year college roadmap for a student.

STUDENT PROFILE:
- Name: ${name}
- Current Grade: ${a.grade || '9th Grade'}
- Track/Interest: ${track}
- School Type: ${a.school || 'Public School'}
- GPA Level: ${a.gpa || '3.5–3.9'}
- Time Available Per Week: ${a.time || '5–10 hrs/week'}
- Current Activities: ${a.activities || 'Nothing listed yet'}
- Goals & Dream Colleges: ${a.goals || 'Not specified'}
- Who filled this out: ${a.who || 'A parent'}${a.custom ? `\n- Additional question/context: ${a.custom}` : ''}

Return ONLY a valid JSON object. NO markdown. NO code blocks. NO explanation before or after. Just raw JSON.

The JSON must match this EXACT structure:

{
  "summary": "2-3 sentence personalized narrative about this specific student's strengths and trajectory",
  "stats": {
    "yearsRemaining": ${yearsRemaining},
    "competitionCount": 8,
    "programCount": 6,
    "deadlineCount": 11
  },
  "arc": [
    {
      "phase": "PREPARATION",
      "grades": "Grades 7–8",
      "cardClass": "prep",
      "items": ["4 specific actions for this student at this stage"]
    },
    {
      "phase": "FOUNDATION",
      "grades": "Grades 9–10",
      "cardClass": "foundation",
      "items": ["4 specific actions for this student at this stage"]
    },
    {
      "phase": "EXECUTION",
      "grades": "Grades 11–12",
      "cardClass": "execution",
      "items": ["4 specific actions for this student at this stage"]
    }
  ],
  "competitions": [
    {
      "name": "Competition Name",
      "badge": "NATIONAL",
      "badgeType": "gold",
      "description": "2-3 sentences personalized with ${name}'s specific interests and goals",
      "grade": "Grade 9+",
      "deadline": "November",
      "difficulty": "Intermediate"
    }
  ],
  "programs": [
    {
      "name": "Program Name",
      "badge": "FREE",
      "badgeType": "teal",
      "description": "2-3 sentences personalized for ${name}",
      "grade": "Grade 10+",
      "deadline": "January",
      "cost": "$0"
    }
  ],
  "collegeTimeline": [
    {
      "grade": "Grade ${gradeNum} — Now",
      "title": "First action item",
      "detail": "2-3 sentences with specific advice for ${name} right now"
    }
  ]
}

RULES — follow exactly:
- badge for competitions: "NATIONAL", "STATE", or "REGIONAL" only
- badge for programs: "FREE", "STIPEND", or "PAID" only
- badgeType: "gold" = most prestigious, "teal" = important, "gray" = entry level
- difficulty: "Beginner", "Intermediate", or "Advanced" only
- Include exactly 6-8 competitions tailored to the track
- Include exactly 5-6 programs — lead with FREE ones (they are more prestigious than paid)
- Include 8-11 college timeline entries from current grade through Grade 12
- Personalize EVERYTHING — use ${name}'s name, track, goals, and activities throughout

TRACK-SPECIFIC GUIDANCE:
${getTrackGuidance(track)}`;
}

function getTrackGuidance(track) {
  const guides = {
    'STEM Research': 'Feature: ISEF, Regeneron STS, Science Olympiad, AMC/AIME, JSHS, Conrad Challenge. Programs: NASA SEES (free), RSI at MIT (free/most selective), NIH SIP (paid stipend), Simons Summer Research (stipend). Emphasize building original research project by Grade 10, university mentor outreach, lab experience.',
    'Pre-Med': 'Feature: HOSA, Science Olympiad, AMSA, Junior Medical Scholars. Programs: NIH SIP, hospital volunteering/shadowing pipelines, Research!America. Emphasize clinical exposure, research in biology/chemistry, MCAT prep awareness, pre-med college list strategy.',
    'Business & Entrepreneurship': 'Feature: DECA, FBLA, Young Entrepreneurs Academy (YEA!), Diamond Challenge, Wharton Global Youth Program. Programs: Wharton summer programs, NFTE, Goldman Sachs 10K Small Businesses. Emphasize real ventures, case competitions, networking.',
    'Arts & Design': 'Feature: Scholastic Art Awards, YoungArts, Congressional Art Competition, regional juried shows. Programs: RISD pre-college (paid), SAIC summer intensive, Pratt pre-college. Emphasize portfolio development timeline, artist statement, art school application differences from Common App.',
    'Humanities & Writing': 'Feature: National History Day, Scholastic Writing Awards, NCTE Achievement Awards, Model UN, National Debate. Programs: Telluride Association Summer Studies (free), Kenyon Review Young Writers (paid), Bread Loaf. Emphasize analytical writing, research depth, publication opportunities.',
    'Athletics': 'Feature: AAU competitions, club team participation, recruiting exposure camps. Programs: NCAA eligibility center registration (Grade 9), sport-specific elite camps. Emphasize NCAA eligibility timeline, GPA requirements (2.3 core GPA), early coach outreach, recruiting video.',
    'Community Leadership': 'Feature: Congressional Award, Prudential Spirit of Community, Presidential Volunteer Service Award (PVSA), Gloria Barron Prize. Programs: Hugh O\'Brian Youth Leadership, National Youth Leadership Forum. Emphasize depth over breadth, measurable community impact, non-profit founding.',
    'Help Me Explore': 'Feature: broad exposure — Science Olympiad, DECA, Model UN, Scholastic Arts/Writing, debate. Programs: Governor\'s School programs (state-based, often free), summer exploration programs across tracks. Emphasize interest discovery, trying multiple tracks in Grades 7-9 before committing, journaling interests.'
  };
  return guides[track] || guides['STEM Research'];
}
