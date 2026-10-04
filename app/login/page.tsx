"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Customer", identifier: "customer@giftapp.demo" },
  { label: "Store Owner", identifier: "store@giftapp.demo" },
  { label: "Admin", identifier: "admin@giftapp.demo" },
];
const DEMO_PASSWORD = "Demo@1234";

const ROLE_HOME: Record<string, string> = {
  CUSTOMER: "/",
  STORE_OWNER: "/store/dashboard",
  ADMIN: "/admin/dashboard",
};

function SignInView({
  identifier, setIdentifier, password, setPassword, error, loading, onSubmit, onForgot,
}: {
  identifier: string; setIdentifier: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  error: string | null; loading: boolean;
  onSubmit: (e?: React.FormEvent) => void; onForgot: () => void;
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="identifier">Email or Phone Number</Label>
          <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or 98XXXXXXXX" required autoComplete="username" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <div className="mt-1.5 text-right">
            <button type="button" onClick={onForgot} className="text-xs font-semibold text-rose">Forgot password?</button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-ink/10" />
        <span className="text-xs text-muted">or continue as</span>
        <div className="h-px flex-1 bg-ink/10" />
      </div>

      <div className="space-y-2">
        {DEMO_ACCOUNTS.map((acc) => (
          <Button
            key={acc.identifier}
            type="button"
            variant="outline"
            className="w-full border-rose text-rose"
            onClick={() => {
              setIdentifier(acc.identifier);
              setPassword(DEMO_PASSWORD);
            }}
          >
            {acc.label}
          </Button>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[10px] text-muted">Tapping a role fills in its demo credentials - tap Sign in to continue.</p>
    </>
  );
}

function ForgotIdentifierView({ onSent }: { onSent: (identifier: string) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <p className="mb-1 font-serif text-base font-semibold">Forgot password</p>
      <p className="mb-4 text-sm text-muted">Enter your registered email or phone number and we&apos;ll send a one-time code (demo).</p>
      <Label htmlFor="forgotIdentifier">Email or Phone Number</Label>
      <Input id="forgotIdentifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or 98XXXXXXXX" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <Button
        className="mt-4 w-full"
        onClick={() => {
          if (!identifier.trim()) { setError("Enter your email or phone number."); return; }
          onSent(identifier.trim());
        }}
      >
        Send OTP
      </Button>
    </>
  );
}

function ResetPasswordView({ identifier, onDone }: { identifier: string; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!otp || otp.length < 4) { setError("Enter the OTP sent to you (demo - any 4-6 digits)."); return; }
    if (!newPassword || newPassword.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (newPassword !== retypePassword) { setError("Passwords do not match."); return; }
    // Demo only: this intentionally does not call the server or change any stored credential.
    onDone();
  }

  return (
    <>
      <p className="mb-1 font-serif text-base font-semibold">Enter OTP</p>
      <p className="mb-4 text-sm text-muted">We&apos;ve sent a one-time code to <b>{identifier}</b> (demo - any 4-6 digits work).</p>
      <Label htmlFor="otp">OTP</Label>
      <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="e.g. 123456" />
      <Label htmlFor="newPassword" className="mt-3">New Password</Label>
      <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <Label htmlFor="retypePassword">Retype New Password</Label>
      <Input id="retypePassword" type="password" value={retypePassword} onChange={(e) => setRetypePassword(e.target.value)} />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <Button className="mt-4 w-full" onClick={submit}>Reset password</Button>
    </>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session_expired");
  const [view, setView] = useState<"signin" | "forgot-identifier" | "forgot-otp">("signin");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Incorrect email/phone or password.");
        setLoading(false);
        return;
      }
      router.push(ROLE_HOME[data.user.role] ?? "/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blush p-6">
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose text-white">
          <Gift className="h-6 w-6" />
        </div>
        <span className="font-serif text-[22px] font-semibold text-ink">Giftly</span>
      </div>
      <p className="mb-5 text-center text-muted">Send a little love</p>

      <div className="w-full max-w-[340px] rounded-[20px] border border-border bg-white p-3.5 shadow-sm [&_input]:h-10 [&_input]:rounded-xl [&_input]:px-3 [&_input]:text-[13px]">
        {sessionExpired && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Your session ended or you don&apos;t have access to that area. Please sign in again.
          </p>
        )}
        {successMsg && view === "signin" && (
          <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            ✓ Password reset successfully (demo). Sign in with your usual demo credentials below.
          </p>
        )}

        {view === "signin" && (
          <SignInView
            identifier={identifier} setIdentifier={setIdentifier}
            password={password} setPassword={setPassword}
            error={error} loading={loading}
            onSubmit={submit}
            onForgot={() => { setView("forgot-identifier"); setSuccessMsg(false); }}
          />
        )}
        {view === "forgot-identifier" && (
          <ForgotIdentifierView onSent={(id) => { setForgotIdentifier(id); setView("forgot-otp"); }} />
        )}
        {view === "forgot-otp" && (
          <ResetPasswordView identifier={forgotIdentifier} onDone={() => { setView("signin"); setSuccessMsg(true); setIdentifier(""); setPassword(""); }} />
        )}

        {view !== "signin" && (
          <button onClick={() => setView("signin")} className="mt-2 w-full rounded-full border border-rose py-2.5 text-center text-sm font-semibold text-rose">
            ← Back to sign in
          </button>
        )}
      </div>

      <p className="mt-4 max-w-[320px] text-center text-[11px] text-muted">
        Demo application - no real payments or deliveries.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
