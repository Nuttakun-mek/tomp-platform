import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

const variants = {
  primary: "bg-operation text-white shadow-sm hover:bg-teal-800 focus-visible:ring-operation/30",
  secondary: "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-operation hover:text-operation focus-visible:ring-operation/20",
  quiet: "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300",
  danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 focus-visible:ring-red-200"
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  return <button className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
}

export function ButtonLink({ className = "", href, children, variant = "primary", ...props }: ButtonLinkProps) {
  return <Link className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition outline-none focus-visible:ring-2 ${variants[variant]} ${className}`} href={href} {...props}>{children}</Link>;
}
