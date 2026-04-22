import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { RequestAccessForm } from "@/components/auth/RequestAccessForm";

function normalizeNextPath(nextPath?: string) {
  if (!nextPath) {
    return "/";
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const session = await getServerSession(authOptions);
  const nextPath = normalizeNextPath(searchParams?.next);

  if (session?.user) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-8 sm:px-8 lg:px-10">
      <section className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="panel-surface panel-hero rounded-[36px] border px-6 py-8 sm:px-8">
          <p className="eyebrow">Private Access</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#fff7ef] sm:text-5xl">
            Sign in to the Kappa-4 classified portal
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[#ddd3c7]">
            This deployment is restricted to the four authorized usernames. Every protected page relocks when focus is
            lost, and the session also expires after five seconds of inactivity.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="signal-card signal-calm rounded-[24px]">
              <span className="signal-label">Access model</span>
              <p className="signal-value">Four exact usernames</p>
            </div>
            <div className="signal-card signal-neutral rounded-[24px]">
              <span className="signal-label">Destination</span>
              <p className="signal-value">Three classified sections</p>
            </div>
            <div className="signal-card signal-opportunity rounded-[24px]">
              <span className="signal-label">Fallback</span>
              <p className="signal-value">Instant relock on leave</p>
            </div>
          </div>
        </article>

        <article className="panel-surface rounded-[36px] border px-6 py-8 sm:px-8">
          <p className="eyebrow">Member Login</p>
          <h2 className="mt-3 text-2xl font-semibold text-[#fff7ef]">Use your assigned username and passcode</h2>
          <p className="mt-3 text-sm leading-7 text-[#cdbfb2]">
            Only the authorized Kappa-4 identities can access this site.
          </p>
          <LoginForm nextPath={nextPath} />

          <div className="mt-8 border-t border-white/10 pt-8">
            <p className="eyebrow">Request Access</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#fff7ef]">Request a 5-minute one-time access session</h2>
            <p className="mt-3 text-sm leading-7 text-[#cdbfb2]">
              Submit your identity and request prompt. The site will capture the device and network address automatically, then send the request for approval as a one-time username and password that cannot be reused after the session locks.
            </p>
            <RequestAccessForm />
          </div>
        </article>
      </section>
    </main>
  );
}
