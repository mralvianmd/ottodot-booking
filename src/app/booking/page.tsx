"use client";

import { useState, useEffect, useCallback } from "react";

interface Parent {
  id: string;
  name: string;
  email: string;
}

interface Student {
  id: string;
  name: string;
  parentId: string;
}

interface TrialClass {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  scheduledAt: string;
  maxSeats: number;
  confirmedCount: number;
  remainingSeats: number;
}

interface BookingResult {
  id: string;
  studentId: string;
  trialClassId: string;
  status: string;
  createdAt: string;
}

interface PendingBooking {
  id: string;
  studentId: string;
  trialClassId: string;
  status: string;
  createdAt: string;
  trialClass: {
    id: string;
    subject: string;
    topic: string;
    teacher: string;
    scheduledAt: string;
    maxSeats: number;
  };
}

export default function BookingPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [classes, setClasses] = useState<TrialClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  // Booking flow state
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [finalStatus, setFinalStatus] = useState<BookingResult | null>(null);

  // Fetch parents on mount
  useEffect(() => {
    async function fetchParents() {
      const res = await fetch("/api/parents");
      if (res.ok) {
        const data = await res.json();
        setParents(data);
      }
    }
    fetchParents();
  }, []);

  // Fetch available classes
  const fetchClasses = useCallback(async () => {
    const res = await fetch("/api/classes");
    if (res.ok) {
      const data = await res.json();
      setClasses(data);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    setBooking(null);
    setFinalStatus(null);
    setError("");
    setPendingBookings([]);
    if (studentId) {
      fetch(`/api/students/${studentId}/pending-bookings`)
        .then((r) => r.ok ? r.json() : [])
        .then(setPendingBookings)
        .catch(() => setPendingBookings([]));
    }
  };

  const handleContinuePayment = (pb: PendingBooking) => {
    setBooking({
      id: pb.id,
      studentId: pb.studentId,
      trialClassId: pb.trialClassId,
      status: pb.status,
      createdAt: pb.createdAt,
    });
    setFinalStatus(null);
    setError("");
  };

  // Fetch students when parent changes
  const handleParentChange = async (parentId: string) => {
    setSelectedParentId(parentId);
    setStudents([]);
    setSelectedStudentId("");
    setBooking(null);
    setFinalStatus(null);
    setError("");
    if (parentId) {
      const res = await fetch(`/api/parents/${parentId}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    }
  };

  const handleBookTrial = async (classId: string) => {
    if (!selectedStudentId) {
      setError("Please select a child first.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedStudentId, classId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setError("This child already has a booking for this class.");
        } else if (res.status === 410) {
          setError("No seats available for this class.");
        } else {
          setError(data.error || "Booking failed.");
        }
        return;
      }

      const bookingData = await res.json();
      setBooking(bookingData);
      await fetchClasses();
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (success: boolean) => {
    if (!booking) return;
    setPaymentProcessing(true);
    setError("");

    try {
      const res = await fetch(`/api/bookings/${booking.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Payment processing failed.");
        return;
      }

      const result = await res.json();
      setFinalStatus(result);
      setBooking(null);
      await fetchClasses();
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchClasses();
      if (selectedStudentId) {
        const res = await fetch(`/api/students/${selectedStudentId}/pending-bookings`);
        if (res.ok) setPendingBookings(await res.json());
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleReset = () => {
    setBooking(null);
    setFinalStatus(null);
    setError("");
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Book a Trial Class
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Demo mode — select a parent to simulate the booking flow.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Parent selector */}
      <div className="mt-8">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Select Parent (Demo)
        </label>
        <select
          value={selectedParentId}
          onChange={(e) => handleParentChange(e.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="">-- Choose a parent --</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      </div>

      {/* Students */}
      {students.length > 0 && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Select Child
          </label>
          <div className="mt-2 flex gap-3">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => handleStudentChange(s.id)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  selectedStudentId === s.id
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Pending bookings — continue payment */}
      {selectedStudentId && pendingBookings.length > 0 && !booking && !finalStatus && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
            Unpaid Bookings
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            These classes were booked but not yet paid. Continue payment to confirm.
          </p>
          <div className="mt-4 space-y-3">
            {pendingBookings.map((pb) => (
              <div
                key={pb.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-950"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {pb.trialClass.subject} — {pb.trialClass.topic}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {pb.trialClass.teacher} &middot;{" "}
                    {new Date(pb.trialClass.scheduledAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Pending payment since {new Date(pb.createdAt).toLocaleDateString("en-US")}
                  </p>
                </div>
                <button
                  onClick={() => handleContinuePayment(pb)}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
                >
                  Continue Payment
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available classes */}
      {selectedStudentId && !booking && !finalStatus && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Available Trial Classes
          </h2>
          <div className="mt-4 space-y-3">
            {classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
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
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    {c.confirmedCount}/{c.maxSeats} confirmed &middot;{" "}
                    {c.remainingSeats} seat(s) left
                  </p>
                </div>
                <button
                  onClick={() => handleBookTrial(c.id)}
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {loading ? "Booking..." : "Book Trial"}
                </button>
              </div>
            ))}
            {classes.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No available classes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Payment step */}
      {booking && !finalStatus && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Booking Created — Pending Payment
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Booking ID:{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
              {booking.id}
            </code>
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Status:{" "}
            <span className="font-medium text-amber-600 dark:text-amber-400">
              {booking.status.replace(/_/g, " ")}
            </span>
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handlePayment(true)}
              disabled={paymentProcessing}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
            >
              {paymentProcessing ? "Processing..." : "Simulate Payment Success"}
            </button>
            <button
              onClick={() => handlePayment(false)}
              disabled={paymentProcessing}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {paymentProcessing ? "Processing..." : "Simulate Payment Failure"}
            </button>
          </div>
        </div>
      )}

      {/* Final status */}
      {finalStatus && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Booking Result
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Booking ID:{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
              {finalStatus.id}
            </code>
          </p>
          <p className="mt-2">
            Status:{" "}
            <span
              className={`font-semibold ${
                finalStatus.status === "CONFIRMED"
                  ? "text-green-600 dark:text-green-400"
                  : finalStatus.status === "PAYMENT_FAILED"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {finalStatus.status.replace(/_/g, " ")}
            </span>
          </p>
          <button
            onClick={handleReset}
            className="mt-4 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Book Another Class
          </button>
        </div>
      )}
    </div>
  );
}
