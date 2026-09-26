import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Ottodot Trial Class Booking
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Book a trial science or math class for your child.
        </p>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2">
        <Link
          href="/booking"
          className="group rounded-xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-zinc-900/50"
        >
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Book a Trial Class
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Select your child, pick an available class, and complete booking with
            simulated payment.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
            Go to booking &rarr;
          </span>
        </Link>

        <Link
          href="/admin/roster"
          className="group rounded-xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:shadow-zinc-900/50"
        >
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Admin: Class Roster
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            View confirmed students per trial class. See seat counts and student
            details.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300">
            View roster &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
