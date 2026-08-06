export interface TabBarOption<T extends string> {
  value: T;
  label: string;
}

export default function TabBar<T extends string>({
  options,
  value,
  onChange,
}: {
  options: TabBarOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md transition-colors ${
            value === opt.value ? "bg-white text-brand-700 shadow-soft font-medium" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
