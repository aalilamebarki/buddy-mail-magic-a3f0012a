import * as React from "react";
import { addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ar } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
};

const SWIPE_THRESHOLD_PX = 40;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  month,
  onMonthChange,
  onTouchStart,
  onTouchEnd,
  ...props
}: CalendarProps) {
  const initialMonth = React.useMemo(() => month ?? props.defaultMonth ?? new Date(), [month, props.defaultMonth]);
  const [internalMonth, setInternalMonth] = React.useState<Date>(initialMonth);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    if (month) {
      setInternalMonth(month);
    }
  }, [month]);

  const activeMonth = month ?? internalMonth;

  const handleMonthChange = React.useCallback(
    (nextMonth: Date) => {
      if (!month) {
        setInternalMonth(nextMonth);
      }
      onMonthChange?.(nextMonth);
    },
    [month, onMonthChange],
  );

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    onTouchStart?.(event);
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    onTouchEnd?.(event);

    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || event.defaultPrevented) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    // Horizontal swipe only (ignore vertical scrolling/dragging)
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    const direction = deltaX < 0 ? 1 : -1;
    handleMonthChange(addMonths(activeMonth, direction));
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="touch-pan-y">
      <DayPicker
        showOutsideDays={showOutsideDays}
        locale={locale || ar}
        dir="rtl"
        month={activeMonth}
        onMonthChange={handleMonthChange}
        className={cn("p-3", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100"),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
          IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        }}
        {...props}
      />
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
