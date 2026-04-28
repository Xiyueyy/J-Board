"use client";

import { AlertCircle, Gauge, Router, WalletCards } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { ProxyInboundOption } from "./proxy-plan-types";

interface ProxyInboundSelectProps {
  inbounds: ProxyInboundOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ProxyInboundSelect({
  inbounds,
  value,
  onValueChange,
  disabled,
}: ProxyInboundSelectProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Router className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">选择线路入口</p>
          <p className="text-xs text-muted-foreground">选择你想使用的连接入口，购买后可在订阅里复制或扫码导入。</p>
        </div>
      </div>
      <Select
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue ?? "")}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="选择一个线路入口">
            {(selectedValue) => {
              const match = inbounds.find((item) => item.id === selectedValue);
              return match ? formatInboundOption(match) : "选择一个线路入口";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {inbounds.map((inbound) => (
            <SelectItem key={inbound.id} value={inbound.id}>
              {formatInboundOption(inbound)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && (
        <p className="flex items-center gap-2 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5" />
          这条线路正在整理中，暂时不接受新的购买。
        </p>
      )}
    </div>
  );
}

interface ProxyTrafficSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function ProxyTrafficSlider({ value, min, max, onChange }: ProxyTrafficSliderProps) {
  const percent = max > min ? Math.round(((value - min) / (max - min)) * 100) : 0;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gauge className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">选择流量额度</p>
            <p className="text-xs text-muted-foreground">按你的本月使用量选择，开通后可随时在订阅页查看剩余额度。</p>
          </div>
        </div>
        <div className="rounded-lg border border-primary/15 bg-primary/10 px-3 py-2 text-right text-primary">
          <p className="text-2xl font-semibold tracking-[-0.05em] tabular-nums">{value}</p>
          <p className="text-[0.68rem] font-semibold tracking-[0.12em]">GB</p>
        </div>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values: number | readonly number[]) => {
          const nextValue = Array.isArray(values) ? values[0] : values;
          onChange(nextValue ?? min);
        }}
        min={min}
        max={max}
        step={max <= 100 ? 1 : 10}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{min} GB</span>
        <span className="rounded-full bg-muted px-2 py-1">当前选择 {percent}%</span>
        <span>{max} GB</span>
      </div>
    </div>
  );
}

export function ProxyPurchaseSummary({ totalPrice }: { totalPrice: string }) {
  return (
    <div className="rounded-lg border border-primary/15 bg-primary/10 p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-button)]">
            <WalletCards className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">本次应付</p>
            <p className="text-xs text-muted-foreground">确认后为你保留订单名额</p>
          </div>
        </div>
        <span className="text-3xl font-semibold tracking-[-0.06em] text-primary tabular-nums">¥{totalPrice}</span>
      </div>
    </div>
  );
}

export function ProxyAvailabilityNotice({ nextAvailableAt }: { nextAvailableAt: string | null }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>
        这款套餐暂时售罄{nextAvailableAt ? `，预计 ${nextAvailableAt} 后有机会补位` : ""}。
      </p>
    </div>
  );
}

function formatInboundOption(inbound: ProxyInboundOption) {
  return inbound.displayName || inbound.tag || "优选线路入口";
}
