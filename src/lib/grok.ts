const GROK_API_KEY = process.env.EXPO_PUBLIC_GROK_API_KEY;
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_MODEL = 'grok-3-mini';
const REQUEST_TIMEOUT_MS = 8000;
const FAILURE_COOLDOWN_MS = 60000;

let lastFailureTime = 0;

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

const FALLBACK_EXPLANATIONS = {
  high: [
    'Heavy workload detected — your brain needs recovery time.',
    'Extended focus periods without breaks increase burnout risk.',
    'Long continuous sessions drain cognitive energy fast.',
    'Back-to-back commitments leave no room to recharge.',
  ],
  medium: [
    'Moderate load today — regular breaks will keep you sharp.',
    'A few strategic pauses will help you stay energized.',
    'Solid schedule, but adding short breaks boosts focus.',
    'Your day is filling up — plan a break before fatigue hits.',
  ],
  low: [
    'Great balance! Your schedule leaves room to breathe.',
    'Well-paced day — keep up the healthy rhythm.',
    'Light schedule today — a good opportunity to recharge.',
    'Your schedule allows for natural recovery.',
  ],
};

const FALLBACK_SUGGESTIONS: Record<string, string> = {
  social: 'Connect with a friend for 10 minutes to recharge your social batteries.',
  walk: 'A quick walk outside can clear your mind and boost creativity.',
  gym: 'Physical activity releases endorphins that fight stress.',
  quiet: 'Find a peaceful spot to rest your mind and breathe deeply.',
  coffee: 'Enjoy a mindful coffee break away from screens.',
};

function getRandomFallback(level: 'low' | 'medium' | 'high'): string {
  const options = FALLBACK_EXPLANATIONS[level];
  return options[Math.floor(Math.random() * options.length)];
}

async function callGrokAPI(
  messages: GrokMessage[],
  maxTokens: number = 60,
  temperature: number = 0.7
): Promise<string | null> {
  if (!GROK_API_KEY) return null;
  if (Date.now() - lastFailureTime < FAILURE_COOLDOWN_MS) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      lastFailureTime = Date.now();
      return null;
    }

    const data: GrokResponse = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (content) {
      return content.replace(/^["']|["']$/g, '').trim();
    }

    return null;
  } catch (error: any) {
    lastFailureTime = Date.now();
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateBurnoutExplanation(
  totalHours: number,
  continuousMinutes: number,
  hasLateBlocks: boolean,
  riskLevel: 'low' | 'medium' | 'high'
): Promise<string> {
  const systemPrompt =
    'You are a caring student wellness advisor inside the Recess app. ' +
    'Respond with exactly ONE short sentence (max 18 words). ' +
    'Be warm, specific, and actionable. No quotes, no bullet points, no emojis.';

  const userPrompt =
    `Analyze this student's burnout risk and give a concise insight:\n` +
    `- Total scheduled hours today: ${totalHours.toFixed(1)}\n` +
    `- Longest continuous work period: ${Math.round(continuousMinutes)} minutes\n` +
    `- Has late-night activities (after 10 PM): ${hasLateBlocks ? 'yes' : 'no'}\n` +
    `- Burnout risk level: ${riskLevel}`;

  const result = await callGrokAPI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    60,
    0.7
  );

  if (result && result.length >= 10 && result.length <= 120) {
    return result;
  }

  return getRandomFallback(riskLevel);
}

export async function generateBreakSuggestion(
  breakType: string,
  duration: number
): Promise<string> {
  const systemPrompt =
    'You are a student wellness coach inside the Recess app. ' +
    'Respond with exactly ONE short, actionable tip (max 15 words). ' +
    'Be specific, friendly, and motivating. No quotes, no emojis.';

  const userPrompt =
    `Give a quick tip for a ${duration}-minute ${breakType} break a college student is about to take.`;

  const result = await callGrokAPI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    40,
    0.8
  );

  if (result && result.length >= 10 && result.length <= 100) {
    return result;
  }

  return FALLBACK_SUGGESTIONS[breakType] || 'Take a moment to breathe and step away from your work.';
}

export function isGrokConfigured(): boolean {
  return !!GROK_API_KEY;
}
