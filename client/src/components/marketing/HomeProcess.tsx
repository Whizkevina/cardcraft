import { MarketingSection } from "./MarketingSection";
import { PageHeader } from "./PageHeader";
import { SurfaceCard } from "./SurfaceCard";
import { hp, hpCn } from "./homeTokens";

const steps = [
  {
    n: "01",
    title: "Choose a template",
    desc: "Pick a layout matched to the occasion — every element stays editable.",
  },
  {
    n: "02",
    title: "Add the portrait",
    desc: "Drop in a photo and fit it cleanly inside the card frame.",
  },
  {
    n: "03",
    title: "Refine the details",
    desc: "Adjust names, dates, fonts, colors, and decorative layers in real time.",
  },
  {
    n: "04",
    title: "Export or share",
    desc: "Download high-resolution files or publish a share link with preview.",
  },
];

export function HomeProcess() {
  return (
    <MarketingSection spacing="default">
      <PageHeader
        level="h2"
        eyebrow="Workflow"
        title="From blank to downloadable in four moves"
        description="A focused editor flow — no sprawling toolbars, no design degree required."
      />

      <div className="relative lg:pl-8">
        <div className="hp-process-line hidden lg:block" aria-hidden />

        <div className="grid gap-4 lg:gap-5">
          {steps.map(step => (
            <SurfaceCard key={step.n} variant="ghost" className="lg:ml-6">
              <div className="flex gap-4 sm:gap-5 p-5 sm:p-6">
                <div className="shrink-0 w-10 text-right">
                  <span className={hpCn(hp.display, "text-lg text-gold/80 tabular-nums")}>{step.n}</span>
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="font-semibold text-sm sm:text-base mb-1.5">{step.title}</h3>
                  <p className={hpCn(hp.lead, "text-sm")}>{step.desc}</p>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </MarketingSection>
  );
}
