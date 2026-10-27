import { useGetList } from "ra-core";

import type { Contact } from "../types";
import { DashboardActivityLog } from "./DashboardActivityLog";
import { DashboardStepper } from "./DashboardStepper";
import { DealsChart } from "./DealsChart";
import { HotContacts } from "./HotContacts";
import { ContactPipeline } from "./ContactPipeline";
import { NotContacted } from "./NotContacted";
import { TasksList } from "./TasksList";
import { TodayAgenda } from "./TodayAgenda";
import { Welcome } from "./Welcome";

export const Dashboard = () => {
  const { total: totalContact, isPending: isPendingContact } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 1 },
    });

  const { total: totalDeal, isPending: isPendingDeal } = useGetList<Contact>(
    "deals",
    {
      pagination: { page: 1, perPage: 1 },
    },
  );

  const isPending = isPendingContact || isPendingDeal;

  if (isPending) {
    return null;
  }

  if (!totalContact) {
    return <DashboardStepper step={1} />;
  }

  // The "add a note" onboarding step no longer blocks the dashboard: the
  // "Not contacted yet" list is exactly where those first notes get written.
  return (
    <div className="mt-1 flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <TodayAgenda />
        </div>
        <div className="lg:col-span-5">
          <NotContacted />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-3">
          <ContactPipeline />
          <TasksList />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {totalDeal ? <DealsChart /> : null}
          <DashboardActivityLog />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-3">
          {import.meta.env.VITE_IS_DEMO === "true" ? <Welcome /> : null}
          <HotContacts />
        </div>
      </div>
    </div>
  );
};
