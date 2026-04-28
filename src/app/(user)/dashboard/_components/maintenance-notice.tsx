export function MaintenanceNotice({ message }: { message: string }) {
  return (
    <section className="rounded-xl border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
      {message}
    </section>
  );
}
