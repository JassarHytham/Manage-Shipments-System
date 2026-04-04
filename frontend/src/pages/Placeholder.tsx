import { Construction } from "lucide-react";

interface PlaceholderProps {
  title: string;
  phase: string;
}

export default function Placeholder({ title, phase }: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <Construction className="w-12 h-12 mb-4" />
      <h2 className="text-lg font-semibold text-slate-600">{title}</h2>
      <p className="text-sm mt-1">سيتم بناؤها في {phase}</p>
    </div>
  );
}
