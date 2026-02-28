import { ScheduleBlock, BurnoutRisk } from '../types';
import { generateBurnoutExplanation } from '../lib/grok';
import { toLocalDateString, toLocalTimeString, localDateTimeFromStrings, getLocalDayOfWeek } from './dateUtils';

interface BurnoutAnalysis {
  totalMinutes: number;
  maxContinuousMinutes: number;
  hasLateBlocks: boolean;
}

function analyzeSchedule(blocks: ScheduleBlock[]): BurnoutAnalysis {
  const today = toLocalDateString();
  const todayDow = getLocalDayOfWeek();

  const todayBlocks = blocks.filter(
    (b) => {
      if (b.type === 'break') return false;
      if (b.end_date && b.end_date < today) return false;
      return b.date === today || (b.day_of_week != null && b.day_of_week === todayDow);
    }
  );

  if (todayBlocks.length === 0) {
    return { totalMinutes: 0, maxContinuousMinutes: 0, hasLateBlocks: false };
  }

  const totalMinutes = todayBlocks.reduce((acc, block) => {
    const dateForCalc = block.date || today;
    const start = localDateTimeFromStrings(dateForCalc, block.start_time);
    const end = localDateTimeFromStrings(dateForCalc, block.end_time);
    const duration = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    return acc + duration;
  }, 0);

  const sortedBlocks = [...todayBlocks].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  let maxContinuousMinutes = 0;
  let currentContinuous = 0;

  for (let i = 0; i < sortedBlocks.length; i++) {
    const dateForCalc = sortedBlocks[i].date || today;
    const blockStart = localDateTimeFromStrings(dateForCalc, sortedBlocks[i].start_time);
    const blockEnd = localDateTimeFromStrings(dateForCalc, sortedBlocks[i].end_time);
    const blockDuration = Math.max(0, (blockEnd.getTime() - blockStart.getTime()) / 60000);

    if (i === 0) {
      currentContinuous = blockDuration;
    } else {
      const prevDate = sortedBlocks[i - 1].date || today;
      const prevEnd = localDateTimeFromStrings(prevDate, sortedBlocks[i - 1].end_time);
      const gap = (blockStart.getTime() - prevEnd.getTime()) / 60000;

      if (gap < 30) {
        currentContinuous += blockDuration;
      } else {
        maxContinuousMinutes = Math.max(maxContinuousMinutes, currentContinuous);
        currentContinuous = blockDuration;
      }
    }
  }
  maxContinuousMinutes = Math.max(maxContinuousMinutes, currentContinuous);

  const hasLateBlocks = todayBlocks.some((b) => {
    const hour = parseInt(b.end_time.split(':')[0], 10);
    return hour >= 22;
  });

  return { totalMinutes, maxContinuousMinutes, hasLateBlocks };
}

export function calculateBurnoutRisk(blocks: ScheduleBlock[]): BurnoutRisk {
  const { totalMinutes, maxContinuousMinutes, hasLateBlocks } = analyzeSchedule(blocks);
  const totalHours = totalMinutes / 60;

  if (totalMinutes === 0) {
    return { level: 'low', reason: 'No scheduled activities today' };
  }

  let level: 'low' | 'medium' | 'high';
  let reason: string;

  if (totalHours >= 7 || maxContinuousMinutes >= 180) {
    level = 'high';
    reason = `${totalHours.toFixed(1)} hours of continuous academic load detected`;
  } else if (totalHours >= 5 || maxContinuousMinutes >= 120 || hasLateBlocks) {
    level = 'medium';
    if (hasLateBlocks) {
      reason = `${totalHours.toFixed(1)} hours scheduled — late night blocks detected`;
    } else {
      reason = `${totalHours.toFixed(1)} hours scheduled — consider adding breaks`;
    }
  } else {
    level = 'low';
    reason = 'Schedule looks balanced';
  }

  return { level, reason };
}

export async function calculateBurnoutRiskWithAI(blocks: ScheduleBlock[]): Promise<BurnoutRisk> {
  const { totalMinutes, maxContinuousMinutes, hasLateBlocks } = analyzeSchedule(blocks);
  const totalHours = totalMinutes / 60;

  if (totalMinutes === 0) {
    return { level: 'low', reason: 'No scheduled activities today' };
  }

  let level: 'low' | 'medium' | 'high';

  if (totalHours >= 7 || maxContinuousMinutes >= 180) {
    level = 'high';
  } else if (totalHours >= 5 || maxContinuousMinutes >= 120 || hasLateBlocks) {
    level = 'medium';
  } else {
    level = 'low';
  }

  const reason = await generateBurnoutExplanation(
    totalHours,
    maxContinuousMinutes,
    hasLateBlocks,
    level
  );

  return { level, reason };
}

export function generateBreakPlan(blocks: ScheduleBlock[]): Array<{ title: string; type: string; start_time: string; end_time: string; date: string }> {
  const today = toLocalDateString();
  const todayDow = getLocalDayOfWeek();

  const todayBlocks = blocks
    .filter(
      (b) => {
        if (b.type === 'break') return false;
        if (b.end_date && b.end_date < today) return false;
        return b.date === today || (b.day_of_week != null && b.day_of_week === todayDow);
      }
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  if (todayBlocks.length === 0) {
    return [];
  }

  const suggestedBreaks: Array<{ title: string; type: string; start_time: string; end_time: string; date: string }> = [];

  for (const block of todayBlocks) {
    const blockStart = localDateTimeFromStrings(today, block.start_time);
    const blockEnd = localDateTimeFromStrings(today, block.end_time);
    const durationMin = Math.max(0, (blockEnd.getTime() - blockStart.getTime()) / 60000);

    if (durationMin >= 90) {
      const midpoint = new Date(blockStart.getTime() + (durationMin / 2) * 60000);
      const breakLength = durationMin >= 150 ? 15 : 10;
      const breakStart = new Date(midpoint.getTime() - (breakLength / 2) * 60000);
      const breakEnd = new Date(breakStart.getTime() + breakLength * 60000);

      suggestedBreaks.push({
        title: durationMin >= 150 ? 'Recharge Break' : 'Quick Stretch',
        type: 'break',
        start_time: toLocalTimeString(breakStart),
        end_time: toLocalTimeString(breakEnd),
        date: today,
      });
    }
  }

  for (let i = 0; i < todayBlocks.length - 1; i++) {
    const currentEnd = localDateTimeFromStrings(today, todayBlocks[i].end_time);
    const nextStart = localDateTimeFromStrings(today, todayBlocks[i + 1].start_time);
    const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / 60000;

    if (gapMinutes >= 15 && gapMinutes <= 120) {
      let continuousLoad = 0;
      for (let j = i; j >= 0; j--) {
        const blockStart = localDateTimeFromStrings(today, todayBlocks[j].start_time);
        const blockEnd = localDateTimeFromStrings(today, todayBlocks[j].end_time);
        continuousLoad += Math.max(0, (blockEnd.getTime() - blockStart.getTime()) / 60000);

        if (j > 0) {
          const prevEnd = localDateTimeFromStrings(today, todayBlocks[j - 1].end_time);
          const prevGap = (blockStart.getTime() - prevEnd.getTime()) / 60000;
          if (prevGap >= 30) break;
        }
      }

      let breakLength = 10;
      if (continuousLoad >= 120) {
        breakLength = Math.min(25, Math.floor(gapMinutes * 0.6));
      } else if (continuousLoad >= 60) {
        breakLength = Math.min(15, Math.floor(gapMinutes * 0.5));
      }

      if (breakLength >= 10) {
        const breakStart = new Date(currentEnd.getTime() + 5 * 60000);
        const breakEnd = new Date(breakStart.getTime() + breakLength * 60000);

        suggestedBreaks.push({
          title: continuousLoad >= 120 ? 'Recharge Break' : 'Short Break',
          type: 'break',
          start_time: toLocalTimeString(breakStart),
          end_time: toLocalTimeString(breakEnd),
          date: today,
        });
      }
    }
  }

  return suggestedBreaks;
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
