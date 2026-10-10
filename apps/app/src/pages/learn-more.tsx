import { Page } from "konsta/react";
import exposureScene from "@/assets/scenes/data-exposure-scene-blue-dark.svg";

/** /learn-more — vertical-pager sibling of `/` (see VerticalPager in App.tsx) */
export function LearnMorePage() {
  return (
    <Page className="bg-bg-app">
      <div className="flex min-h-full flex-col px-6 pt-[env(safe-area-inset-top)] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <img src={exposureScene} alt="" className="w-full" />
        <h1 className="m-0 mt-6 font-display text-display font-semibold text-text-primary">
          Thousands of scummy data brokers publicly share your personal data
        </h1>
      </div>
    </Page>
  );
}
