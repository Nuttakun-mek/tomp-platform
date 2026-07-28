"use client";

import { useMemo, useState, useTransition } from "react";
import type { Assignment, DriverIssueType, IncidentSeverity, Project } from "@tomp/types/domain";
import { createIncidentAction } from "@/app/actions/incidents";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildRecoveryRecommendation, mapRecoveryActionToThai } from "@/lib/domain/recovery-rules";

const issueTypes: Array<{ value: DriverIssueType; label: string }> = [
  { value: "delay", label: "ล่าช้า" },
  { value: "vehicle", label: "ปัญหารถ" },
  { value: "passenger", label: "ปัญหาผู้โดยสาร" },
  { value: "route", label: "ปัญหาเส้นทาง" },
  { value: "safety", label: "ความปลอดภัย" },
  { value: "other", label: "อื่น ๆ" }
];

const severities: Array<{ value: IncidentSeverity; label: string }> = [
  { value: "warning", label: "ต้องติดตาม" },
  { value: "urgent", label: "เร่งด่วน" },
  { value: "critical", label: "วิกฤต" },
  { value: "info", label: "ข้อมูล" }
];

export function IncidentForm({ projects, assignments }: { projects: Project[]; assignments: Assignment[] }) {
  const [isPending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "");
  const [issueType, setIssueType] = useState<DriverIssueType>("delay");
  const [severity, setSeverity] = useState<IncidentSeverity>("warning");
  const [message, setMessage] = useState("");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const visibleAssignments = useMemo(() => assignments.filter((assignment) => assignment.projectId === projectId), [assignments, projectId]);
  const recommendation = buildRecoveryRecommendation({ issueType, severity, minutesOpen: 0 });

  function submitIncident() {
    setResultMessage(null);
    startTransition(async () => {
      const result = await createIncidentAction({
        projectId,
        assignmentId: assignmentId || null,
        issueType,
        severity,
        message,
        metadata: {
          source: "recovery_center",
          recommendedActions: recommendation.actions
        }
      });
      setResultMessage(result.success ? "บันทึกเหตุผิดปกติและ Timeline แล้ว" : result.error || "บันทึกเหตุผิดปกติไม่สำเร็จ");
      if (result.success) setMessage("");
    });
  }

  return (
    <section className="enterprise-card p-5 lg:p-6">
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-operation">เปิดเหตุผิดปกติ</p>
        <h2 className="text-2xl font-semibold text-ink">บันทึกสถานการณ์ที่ต้องกู้คืน</h2>
        <p className="text-sm leading-6 text-slate-600">ทุกเหตุผิดปกติจะสร้าง Timeline เพื่อให้ศูนย์ควบคุมตรวจย้อนหลังได้</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          โครงการ
          <Select value={projectId} onChange={(event) => {
            setProjectId(event.target.value);
            const nextAssignment = assignments.find((assignment) => assignment.projectId === event.target.value);
            setAssignmentId(nextAssignment?.id ?? "");
          }}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.projectCode} | {project.projectName}</option>
            ))}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Assignment
          <Select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
            <option value="">ยังไม่ผูก Assignment</option>
            {visibleAssignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>{assignment.status} | {assignment.id.slice(0, 8)}</option>
            ))}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          ประเภทเหตุ
          <Select value={issueType} onChange={(event) => setIssueType(event.target.value as DriverIssueType)}>
            {issueTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          ระดับความรุนแรง
          <Select value={severity} onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}>
            {severities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
          รายละเอียด
          <Textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="เช่น คนขับแจ้งรถเสียบริเวณจุดรับ ต้องเปลี่ยนรถสำรอง" />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <p className="font-semibold">คำแนะนำเบื้องต้น: {recommendation.riskLabel}</p>
        <p className="mt-1 text-sm leading-6">{recommendation.operatorMessage}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {recommendation.actions.map((action) => (
            <span key={action} className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{mapRecoveryActionToThai(action)}</span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={isPending || !projectId || !message.trim()} onClick={submitIncident}>
          {isPending ? "กำลังบันทึก..." : "บันทึกเหตุผิดปกติ"}
        </Button>
        {resultMessage ? <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">{resultMessage}</p> : null}
      </div>
    </section>
  );
}
