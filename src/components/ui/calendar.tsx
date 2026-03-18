import * as React from "react";
import { addMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ar } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const SWIPE_THRESHOLD_PX = 30;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale,
  month,
  onMonthChange,
  ...props
}: CalendarProps) {
  const initialMonth = React.useMemo(() => month ?? props.defaultMonth ?? new Date(), [month, props.defaultMonth]);
  const [internalMonth, setInternalMonth] = React.useState<Date>(initialMonth);
  const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  
  const [translateX, setTranslateX] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const activeMonthRef = React.useRef<Date>(initialMonth);

  React.useEffect(() => {
    if (month) {
      setInternalMonth(month);
    }
  }, [month]);

  const activeMonth = month ?? internalMonth;
  activeMonthRef.current = activeMonth;

  const handleMonthChange = React.useCallback(
    (nextMonth: Date) => {
      if (!month) {
        setInternalMonth(nextMonth);
      }
      onMonthChange?.(nextMonth);
    },
    [month, onMonthChange],
  );

  const animateAndChange = React.useCallback(
    (direction: 1 | -1) => {
      setTranslateX(0);
      setIsSwiping(false);
      handleMonthChange(addMonths(activeMonthRef.current, direction));
    },
    [handleMonthChange],
  );

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setIsSwiping(false);
    setTranslateX(0);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    // Only track horizontal movement
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setIsSwiping(true);
      // Dampen the movement for a controlled feel
      setTranslateX(deltaX * 0.4);
    }
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (!start || event.defaultPrevented) {
      setTranslateX(0);
      setIsSwiping(false);
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Date.now() - start.time;

    // Check for valid horizontal swipe (distance OR velocity)
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
    const hasSufficientDistance = Math.abs(deltaX) >= SWIPE_THRESHOLD_PX;
    const hasSufficientVelocity = Math.abs(deltaX) / elapsed > 0.3;

    if (isHorizontal && (hasSufficientDistance || hasSufficientVelocity)) {
      const direction = deltaX < 0 ? 1 : -1;
      animateAndChange(direction);
    } else {
      // Snap back
      setTranslateX(0);
      setIsSwiping(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="touch-pan-y overflow-hidden relative"
    >
      <div
        style={
          isSwiping
            ? { transform: `translateX(${translateX}px)`, opacity: 1 - Math.abs(translateX) / 300, transition: 'none' }
            : { transform: 'translateX(0)', opacity: 1, transition: 'transform 0.15s ease-out, opacity 0.15s ease-out' }
        }
      >
        <DayPicker
          showOutsideDays={showOutsideDays}
          locale={locale || ar}
          dir="rtl"
          month={activeMonth}
          onMonthChange={handleMonthChange}
          className={cn("p-3 pointer-events-auto", className)}
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
            day_today: "bg-primary text-primary-foreground font-bold rounded-full",
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
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
