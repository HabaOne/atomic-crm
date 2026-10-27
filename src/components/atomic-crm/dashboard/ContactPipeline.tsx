import { LayoutGrid } from "lucide-react";
import { useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";

import { buildColumnFilter } from "../board/boardLogic";
import { NO_STAGE, type ContactStage } from "../board/contactStages";
import { useContactStages } from "../board/useContactStages";

/** Contact counts per lifecycle stage, linking to the board. */
export const ContactPipeline = () => {
  const translate = useTranslate();
  const { stages } = useContactStages();
  return (
    <section className="flex flex-col gap-2" aria-labelledby="pipeline-title">
      <div className="flex items-center min-h-9">
        <LayoutGrid className="mr-3 size-6 text-muted-foreground" aria-hidden />
        <h2
          id="pipeline-title"
          className="flex-1 text-xl font-semibold text-muted-foreground"
        >
          {translate("crm.dashboard.pipeline")}
        </h2>
        <Link to="/board" className="text-sm font-medium hover:underline">
          {translate("crm.dashboard.open_board")}
        </Link>
      </div>
      <Card className="gap-0 p-2">
        {stages.map((stage) => (
          <StageCount key={stage.value} stage={stage} />
        ))}
        <StageCount
          stage={{
            value: NO_STAGE,
            label: translate("crm.board.no_stage"),
            color: "transparent",
            substatuses: [],
          }}
          muted
        />
      </Card>
    </section>
  );
};

const StageCount = ({
  stage,
  muted,
}: {
  stage: ContactStage;
  muted?: boolean;
}) => {
  const { total } = useGetList("contacts", {
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
    filter: buildColumnFilter(stage.value),
    meta: { columns: ["id"] },
  });
  return (
    <Link
      to="/board"
      className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm hover:bg-accent"
    >
      <span
        className="size-2.5 rounded-full border"
        style={{
          backgroundColor: stage.color,
          borderColor: muted ? "var(--border)" : stage.color,
        }}
        aria-hidden
      />
      <span className={muted ? "flex-1 text-muted-foreground" : "flex-1"}>
        {stage.label}
      </span>
      <span className="font-semibold tabular-nums">{total ?? "·"}</span>
    </Link>
  );
};
