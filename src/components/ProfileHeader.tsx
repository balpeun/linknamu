import Image from 'next/image';

type Props = {
  name: string;
  bio: string;
  avatar?: string;
};

export default function ProfileHeader({ name, bio, avatar }: Props) {
  const initial = Array.from(name.trim())[0] ?? '?';

  return (
    <header className="flex flex-col items-center text-center">
      {avatar ? (
        <Image
          src={avatar}
          alt={`${name} 프로필 사진`}
          width={112}
          height={112}
          priority
          className="size-28 rounded-full object-cover ring-4 ring-white dark:ring-neutral-800"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex size-28 items-center justify-center rounded-full bg-emerald-700 text-4xl font-semibold text-white ring-4 ring-white dark:bg-emerald-600 dark:ring-neutral-800"
        >
          {initial}
        </div>
      )}
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{name}</h1>
      {bio && <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{bio}</p>}
    </header>
  );
}
