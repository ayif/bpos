import { ShoppingBag } from "lucide-react";

export default function LoadingScreen({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="h-11 w-11 rounded-xl bg-brand-600 flex items-center justify-center shadow-soft animate-pulse">
        <ShoppingBag className="h-6 w-6 text-white" strokeWidth={2.25} />
      </div>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
