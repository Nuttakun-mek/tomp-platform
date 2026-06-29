export function MapPlaceholder() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <div>
          <h2 className="text-lg font-semibold text-ink">แผนที่ติดตามสถานะ</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            พื้นที่แสดงภาพรวมตำแหน่งสำหรับ Pilot ภายใน โดย Google Maps ใช้สำหรับนำทาง และยังไม่ใช่ระบบติดตาม GPS แบบ production
          </p>
        </div>
      </div>
    </section>
  );
}
