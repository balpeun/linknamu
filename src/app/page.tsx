import LinkCard from '@/components/LinkCard';
import ProfileHeader from '@/components/ProfileHeader';
import ThemeToggle from '@/components/ThemeToggle';
import { profile } from '@/data/profile';

export default function Home() {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-16 sm:pt-20">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <ProfileHeader name={profile.name} bio={profile.bio} avatar={profile.avatar} />

      {profile.links.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-3">
          {profile.links.map((link) => (
            <li key={link.id}>
              <LinkCard id={link.id} title={link.title} url={link.url} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-center text-sm text-stone-500 dark:text-stone-400">아직 등록된 링크가 없습니다.</p>
      )}

      <footer className="mt-auto pt-12 text-center text-xs text-stone-500">링크나무</footer>
    </main>
  );
}
