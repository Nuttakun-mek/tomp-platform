import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

const variants = {
  primary: "bg-operation text-white shadow-sm hover:bg-teal-800",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:border-operation hover:text-operation",
  quiet: "text-slate-700 hover:bg-slate-100"
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  return <button className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition ${variants[variant]} ${className}`} {...props} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
}

export function ButtonLink({ className = "", href, children, variant = "primary", ...props }: ButtonLinkProps) {
  return <Link className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition ${variants[variant]} ${className}`} href={href} {...props}>{children}</Link>;
}

