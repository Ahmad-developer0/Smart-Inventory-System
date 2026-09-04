import { Shirt, HardHat, ShoppingBag, Footprints, Backpack, Glasses, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const map: Record<string, LucideIcon> = {
  Shirt, HardHat, ShoppingBag, Footprints, Backpack, Glasses,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? Package;
  return <Icon className={className} />;
}
