"use client";

import { useState, useEffect, useCallback } from "react";

interface TrialClass {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  scheduledAt: string;
  maxSeats: number;
  confirmedCount: number;
  remainingSeats: number;
  status: string;
}

interface RosterEntry {
  bookingId: string;
  studentName: string;
  parentName: string;
  bookedAt: string;
  status: string;
}

interface Scenario {
  id: string;
  label: string;
  description: string;
}

const SCENARIOS: Scenario[] = [
  { id: "empty", label: "Empty (0/4)", description: "No bookings" },
  { id: "one_confirmed", label: "1/4 Confirmed", description: "One student confirmed" },
  { id: "two_confirmed", label: "2/4 Confirmed", description: "Two students confirmed" },
  { id: "last_seat", label: "3/4 Confirmed (last seat)", description: "Three confirmed — 1 seat left" },
  { id: "full", label: "4/4 Full", description: "Class is full" },
  { id: "mixed", label: "Mixed (1 confirmed + pending + failed)", description: "One confirmed, one pending, one failed" },
];

export default function AdminRosterPage() {
  const [classes, setClasses] = useState<TrialClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [selectedClassDetail, setSelectedClassDetail] = useState<TrialClass | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState("empty");
  const [refreshing, setRefreshing] = useState(false);
  // Use static scenario list
  const scenarios = SCENARIOS;

  const fetchClasses = useCallback(async () => {
    const res = await fetch("/api/admin/classes");
    if (res.ok) {
      const data = await res.json();
      setClasses(data);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleSelectClass = async (classId: string) => {
    setSelectedClassId(classId);
    setLoading(true);

    try {
      const detailRes = await fetch(`/api/classes/${classId}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setSelectedClassDetail(detail);
        setRoster(detail.roster || []);
      }

      const rosterRes = await fetch(`/api/classes/${classId}/roster`);
      if (rosterRes.ok) {
        const rosterData = await rosterRes.json();
        setRoster(rosterData);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshClass = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      await fetchClasses();

      const detailRes = await fetch(`/api/classes/${selectedClassId}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setSelectedClassDetail(detail);
        setRoster(detail.roster || []);
      }

      const rosterRes = await fetch(`/api/classes/${selectedClassId}/roster`);
      if (rosterRes.ok) {
        const rosterData = await rosterRes.json();
        setRoster(rosterData);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await fetchClasses();
      if (selectedClassId) {
        const detailRes = await fetch(`/api/classes/${selectedClassId}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          setSelectedClassDetail(detail);
          setRoster(detail.roster || []);
        }
        const rosterRes = await fetch(`/api/classes/${selectedClassId}/roster`);
        if (rosterRes.ok) {
          setRoster(await rosterRes.json());
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleReset = async () => {
    if (!selectedClassId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/reset`, {
        method: "POST",
      });
      if (res.ok) {
        await refreshClass();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedClassId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: selectedScenario }),
      });
      if (res.ok) {
        await refreshClass();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Split classes into available and full
  const availableClasses = classes.filter((c) => c.remainingSeats > 0);
  const fullClasses = classes.filter((c) => c.remainingSeats <= 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Admin: Class Roster
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            View all students per trial class.
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Available classes */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Available Classes
        </h2>
        <div className="space-y-3">
          {availableClasses.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectClass(c.id)}
              className={`w-full rounded-lg border px-5 py-4 text-left transition ${
                selectedClassId === c.id
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {c.subject} — {c.topic}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {c.teacher} &middot;{" "}
                    {new Date(c.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {c.confirmedCount}/{c.maxSeats}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.remainingSeats} seat{c.remainingSeats !== 1 ? "s" : ""} left
                  </p>
                </div>
              </div>
            </button>
          ))}
          {availableClasses.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No available classes.
            </p>
          )}
        </div>
      </div>

      {/* Full classes — different table */}
      {fullClasses.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Full Classes
          </h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Teacher</th>
                  <th className="px-4 py-3 font-medium">Schedule</th>
                  <th className="px-4 py-3 font-medium text-center">Seats</th>
                  <th className="px-4 py-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {fullClasses.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800 ${
                      selectedClassId === c.id
                        ? "bg-blue-50 dark:bg-blue-950"
                        : "bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {c.subject} — {c.topic}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {c.teacher}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {new Date(c.scheduledAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                        {c.confirmedCount}/{c.maxSeats} FULL
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleSelectClass(c.id)}
                        className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        View Roster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roster detail */}
      {selectedClassId && selectedClassDetail && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {selectedClassDetail.subject} — {selectedClassDetail.topic}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {selectedClassDetail.teacher} &middot;{" "}
            {selectedClassDetail.confirmedCount}/{selectedClassDetail.maxSeats}{" "}
            confirmed
          </p>

          {/* Admin Controls */}
          <div className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            {/* Reset */}
            <button
              onClick={handleReset}
              disabled={actionLoading}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {actionLoading ? "Resetting..." : "Reset Class"}
            </button>

            {/* Simulate */}
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Scenario
                </label>
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSimulate}
                disabled={actionLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {actionLoading ? "Simulating..." : "Simulate Class"}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Loading roster...
            </p>
          ) : roster.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Parent</th>
                  <th className="pb-2 font-medium">Booked At</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((entry) => (
                  <tr
                    key={entry.bookingId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="py-2 text-zinc-900 dark:text-zinc-100">
                      {entry.studentName}
                    </td>
                    <td className="py-2 text-zinc-600 dark:text-zinc-400">
                      {entry.parentName}
                    </td>
                    <td className="py-2 text-zinc-500 dark:text-zinc-400">
                      {new Date(entry.bookedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : entry.status === "PENDING_PAYMENT"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                            : entry.status === "PAYMENT_FAILED"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No students booked yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
