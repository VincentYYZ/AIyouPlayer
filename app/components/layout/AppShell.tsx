import { PlayerBar } from "@/app/components/player/PlayerBar";
import { TopBar } from "@/app/components/topbar/TopBar";
import { ParticleCloudStage } from "@/app/components/visualizer/ParticleCloudStage";

export function AppShell() {
  return (
    <main className="relative flex min-h-dvh flex-col">
      <TopBar />
      <section className="w-full flex-1 pb-[430px] pt-2 md:pb-[440px] md:pt-3">
        <ParticleCloudStage />
      </section>
      <PlayerBar />
    </main>
  );
}
