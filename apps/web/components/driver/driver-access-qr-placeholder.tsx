interface DriverAccessQrPlaceholderProps {
  accessUrl: string;
}

export function DriverAccessQrPlaceholder({ accessUrl }: DriverAccessQrPlaceholderProps) {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-operation">ข้อมูลตัวอย่างสำหรับ Pilot ภายใน</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">ลิงก์ QR สำหรับคนขับ</h2>
      <div className="mt-4 flex aspect-square w-40 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-center text-sm font-semibold text-slate-600">
        QR
      </div>
      <p className="mt-4 break-all text-sm text-slate-700">{accessUrl}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">ระบบสร้างและเก็บ token แบบ hash ฝั่ง server แล้ว ภาพ QR จริงยังเป็นงานต่อยอดก่อนใช้งานจริง</p>
    </section>
  );
}
