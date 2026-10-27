import { CalendarPlus } from "lucide-react";
import { useTranslate, type Identifier } from "ra-core";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ScheduleDialog } from "./ScheduleDialog";

/** Opens the schedule dialog, optionally for one contact. */
export const ScheduleButton = ({
  contactId,
  display = "button",
  label,
  variant = "outline",
  size = "sm",
  className,
}: {
  contactId?: Identifier;
  display?: "button" | "icon";
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const text = label ?? translate("crm.schedule.button");

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={variant}
                size="icon"
                className={className ?? "size-8"}
                aria-label={text}
                onClick={() => setOpen(true)}
              >
                <CalendarPlus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{text}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          onClick={() => setOpen(true)}
        >
          <CalendarPlus className="size-4" />
          {text}
        </Button>
      )}
      <ScheduleDialog
        open={open}
        onClose={() => setOpen(false)}
        contactId={contactId}
      />
    </>
  );
};
