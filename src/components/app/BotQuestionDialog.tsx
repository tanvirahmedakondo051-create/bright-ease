import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export type BotQuestion = { q: string; options: string[] };
export type BotQuestionAnswer = { question: string; answer: string };

export function BotQuestionDialog({ questions, onDone, onCancel }: {
  questions: BotQuestion[] | null;
  onDone: (answers: BotQuestionAnswer[]) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    setIndex(0);
    setAnswers([]);
    setSelected("");
    setCustom("");
  }, [questions]);

  if (!questions?.length) return null;
  const question = questions[index];
  if (!question) return null;
  const current = custom.trim() || selected;

  const go = (answer: string) => {
    const nextAnswers = [...answers];
    nextAnswers[index] = answer;
    if (index === questions.length - 1) {
      onDone(questions.map((item, i) => ({ question: item.q, answer: nextAnswers[i] || "" })));
      return;
    }
    const nextIndex = index + 1;
    setAnswers(nextAnswers);
    setIndex(nextIndex);
    setSelected(nextAnswers[nextIndex] || "");
    setCustom("");
  };

  const back = () => {
    if (index === 0) return onCancel();
    const previous = index - 1;
    setIndex(previous);
    setSelected(answers[previous] || "");
    setCustom("");
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-background/80 backdrop-blur-md sm:place-items-center sm:p-5" role="dialog" aria-modal="true">
      <div className="w-full overflow-hidden rounded-t-3xl border border-border bg-popover shadow-2xl sm:max-w-xl sm:rounded-2xl">
        <div className="h-1 bg-muted"><div className="h-full bg-brand transition-all duration-500" style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={back} aria-label="পেছনে"><ArrowLeft /></Button>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-cyan">প্রশ্ন {index + 1} / {questions.length}</span>
            <span className="size-9" />
          </div>
          <h2 className="text-xl font-bold leading-relaxed sm:text-2xl">{question.q}</h2>
          <div className="mt-5 grid gap-2.5">
            {question.options.map((option) => {
              const active = selected === option && !custom;
              return (
                <Button key={option} variant="outline" onClick={() => { setSelected(option); setCustom(""); }} className={`h-auto min-h-14 justify-start whitespace-normal rounded-xl px-4 py-3 text-left ${active ? "border-cyan bg-cyan/10" : ""}`}>
                  <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-cyan bg-cyan text-background" : "border-muted-foreground"}`}>{active && <Check className="size-3" />}</span>
                  <span>{option}</span>
                </Button>
              );
            })}
          </div>
          <input value={custom} onChange={(event) => { setCustom(event.target.value); setSelected(""); }} placeholder="নিজের উত্তর লিখুন..." className="mt-3 min-h-13 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-cyan" autoFocus />
          <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
            <Button variant="outline" className="min-h-12 rounded-xl" onClick={() => go("")}>এড়িয়ে যান</Button>
            <Button className="min-h-12 rounded-xl bg-brand" onClick={() => go(current)} disabled={!current}>{index === questions.length - 1 ? "প্ল্যান তৈরি করুন" : "পরবর্তী"}<ArrowRight /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}