import logoAsset from "@/assets/rental-lift-logo.png.asset.json";

export function Logo({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Rental Lift"
      className={className}
      draggable={false}
    />
  );
}
