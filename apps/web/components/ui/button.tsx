import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

const variants = {
  primary: "bg-operation text-white shadow-[0_12px_28px_rgba(8,123,115,0.22)] hover:bg-operation-deep focus-visible:ring-operation/30",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-[0_8px_20px_rgba(16,32,51,0.06)] hover:border-operation hover:text-operation focus-visible:ring-operation/20",
  quiet: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300",
  danger: "bg-danger text-white shadow-[0_12px_28px_rgba(189,47,42,0.18)] hover:bg-red-800 focus-visible:ring-red-200"
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  return <button className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition duration-200 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
}

export function ButtonLink({ className = "", href, children, variant = "primary", ...props }: ButtonLinkProps) {
  return <Link className={`inline-flex min-h-11 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition duration-200 outline-none focus-visible:ring-2 ${variants[variant]} ${className}`} href={href} {...props}>{children}</Link>;
}
