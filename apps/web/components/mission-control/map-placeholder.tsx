export function MapPlaceholder() {
  return (
    <section className="flex min-h-64 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 p-5 text-center">
      <div>
        <h2 className="text-lg font-semibold text-ink">แผนที่ติดตามสถานะ</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">พื้นที่แสดงภาพรวมตำแหน่งสำหรับ Pilot ภายใน โดย Google Maps ยังคงใช้สำหรับนำทาง และยังไม่เปิดใช้การติดตาม GPS แบบ production</p>
      </div>
    </section>
  );
}
