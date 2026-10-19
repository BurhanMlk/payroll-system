type LogoProps = {
  className?: string;
  alt?: string;
};

export default function Logo({
  className = "",
  alt = "EduPayroll",
}: LogoProps) {
  return (
    <img
      src="/branding/edupayroll-logo.png"
      alt={alt}
      className={`bg-white ${className}`}
      draggable={false}
    />
  );
}