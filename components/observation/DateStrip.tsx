import { ScrollView, View } from "react-native";

import { Chip } from "./formPrimitives";

// Horizontal scroll of recent dates. Today + Yesterday are pinned at
// the front; older days follow as "MAY 5", "MAY 4", … going back
// `lookbackDays` days. We don't show a calendar — the vast majority of
// public observations are filed within a week of the event, and a
// linear strip of chips is faster than a date picker.

const MONTH_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

interface Props {
  value: Date;
  onChange: (next: Date) => void;
  lookbackDays?: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateStrip({ value, onChange, lookbackDays = 14 }: Props) {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const days: { date: Date; label: string }[] = [
    { date: today, label: "TODAY" },
    { date: yesterday, label: "YESTERDAY" },
  ];
  for (let i = 2; i <= lookbackDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ date: d, label: `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
    >
      {days.map(({ date, label }) => (
        <View key={date.toISOString()}>
          <Chip
            label={label}
            selected={sameDay(value, date)}
            onPress={() => onChange(date)}
            size="md"
          />
        </View>
      ))}
    </ScrollView>
  );
}
