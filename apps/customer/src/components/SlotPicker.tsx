import React from "react";
import { Zap, Calendar, Clock } from "lucide-react";
import type { BookingSlot } from "../api/bookings.js";

interface SlotPickerProps {
  slot: BookingSlot;
  customerNotes?: string;
  onSlotChange: (slot: BookingSlot) => void;
  onNotesChange: (notes: string) => void;
}

const TIME_WINDOWS = [
  { startTime: "08:00", endTime: "10:00", label: "08:00 - 10:00 AM" },
  { startTime: "11:00", endTime: "13:00", label: "11:00 - 01:00 PM" },
  { startTime: "14:00", endTime: "16:00", label: "02:00 - 04:00 PM" },
  { startTime: "17:00", endTime: "19:00", label: "05:00 - 07:00 PM" },
];

export const SlotPicker: React.FC<SlotPickerProps> = ({
  slot,
  customerNotes = "",
  onSlotChange,
  onNotesChange,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const dayAfter = new Date(Date.now() + 86400000 * 2);
  const dayAfterStr = dayAfter.toISOString().slice(0, 10);

  const DATE_OPTIONS = [
    { date: todayStr, label: "Today" },
    { date: tomorrowStr, label: "Tomorrow" },
    {
      date: dayAfterStr,
      label: dayAfter.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    },
  ];

  return (
    <div
      className="glass-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        borderRadius: "18px",
        border: "1px solid rgba(5, 150, 105, 0.22)",
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 253, 244, 0.93) 100%), url('/hero-clean-tech.jpg') right center/cover no-repeat",
        boxShadow: "0 10px 30px -4px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
            border: "1px solid #a7f3d0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#059669",
          }}
        >
          <Clock size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>Pickup Schedule</h3>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Choose arrival window for your neighborhood partner</span>
        </div>
      </div>

      {/* ASAP vs Scheduled Switcher */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          background: "#f1f5f9",
          padding: "5px",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
        }}
      >
        <button
          type="button"
          onClick={() =>
            onSlotChange({
              ...slot,
              type: "asap",
              date: todayStr,
            })
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "11px",
            borderRadius: "10px",
            border: slot.type === "asap" ? "1px solid #a7f3d0" : "none",
            background: slot.type === "asap" ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "transparent",
            color: slot.type === "asap" ? "#ffffff" : "#475569",
            boxShadow: slot.type === "asap" ? "0 4px 12px rgba(5, 150, 105, 0.25)" : "none",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <Zap size={16} /> ASAP (15-30 mins)
        </button>

        <button
          type="button"
          onClick={() =>
            onSlotChange({
              ...slot,
              type: "scheduled",
            })
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "11px",
            borderRadius: "10px",
            border: slot.type === "scheduled" ? "1px solid #a7f3d0" : "none",
            background: slot.type === "scheduled" ? "linear-gradient(135deg, #059669 0%, #047857 100%)" : "transparent",
            color: slot.type === "scheduled" ? "#ffffff" : "#475569",
            boxShadow: slot.type === "scheduled" ? "0 4px 12px rgba(5, 150, 105, 0.25)" : "none",
            fontWeight: 800,
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <Calendar size={16} /> Schedule Later
        </button>
      </div>

      {/* Scheduled Configuration */}
      {slot.type === "scheduled" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <span className="input-label" style={{ display: "block", marginBottom: "8px" }}>
              Select Day
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              {DATE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.date}
                  onClick={() => onSlotChange({ ...slot, date: opt.date })}
                  style={{
                    flex: 1,
                    padding: "11px 10px",
                    borderRadius: "12px",
                    border:
                      slot.date === opt.date
                        ? "2px solid #059669"
                        : "1px solid #e2e8f0",
                    background: slot.date === opt.date ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)" : "#ffffff",
                    color: slot.date === opt.date ? "#047857" : "#475569",
                    boxShadow: slot.date === opt.date ? "0 2px 8px rgba(5, 150, 105, 0.15)" : "0 1px 3px rgba(15, 23, 42, 0.04)",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="input-label" style={{ display: "block", marginBottom: "8px" }}>
              Select Time Window
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {TIME_WINDOWS.map((win) => {
                const isSelected = slot.startTime === win.startTime;
                return (
                  <button
                    type="button"
                    key={win.startTime}
                    onClick={() =>
                      onSlotChange({
                        ...slot,
                        startTime: win.startTime,
                        endTime: win.endTime,
                      })
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "11px 14px",
                      borderRadius: "12px",
                      border: isSelected
                        ? "2px solid #059669"
                        : "1px solid #e2e8f0",
                      background: isSelected ? "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)" : "#ffffff",
                      color: isSelected ? "#047857" : "#475569",
                      boxShadow: isSelected ? "0 2px 8px rgba(5, 150, 105, 0.15)" : "0 1px 3px rgba(15, 23, 42, 0.04)",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Clock size={15} color={isSelected ? "#059669" : "#64748b"} />
                    <span>{win.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Customer Instructions / Notes */}
      <div className="input-group" style={{ marginBottom: 0 }}>
        <label className="input-label">Instructions for Partner (Optional)</label>
        <input
          type="text"
          className="input-field"
          placeholder="e.g. Elevator available, 3rd floor, call on gate"
          value={customerNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "12px 14px",
            fontSize: "13px",
            color: "#0f172a",
          }}
        />
      </div>
    </div>
  );
};
