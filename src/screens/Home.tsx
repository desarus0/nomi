import { useNavigate } from 'react-router-dom';
import { Avatar, Bubble, PrimaryButton, Screen, SecondaryButton } from '../components/ui';

// Fig. 2 – Home (FR05): create a party or join one with a code.
function Poster({ cuisine, price, name, bg, fg, w, h, rot, big, shadow = false }: {
  cuisine: string; price: string; name: string; bg: string; fg: string; w: number; h: number; rot: number; big: number; shadow?: boolean;
}) {
  return (
    <div className="flex flex-none flex-col justify-between rounded-[22px] p-[18px]"
      style={{ width: w, height: h, background: bg, color: fg, transform: `rotate(${rot}deg)`, boxShadow: shadow ? '0 18px 40px rgba(0,0,0,0.18)' : undefined }}>
      <span className="text-[13px] font-semibold tracking-[0.2px] opacity-85">{cuisine.toUpperCase()} · {price}</span>
      <span className="disp leading-[0.98] tracking-[-1.2px]" style={{ fontSize: big }}>{name}</span>
    </div>
  );
}

export default function Home() {
  const nav = useNavigate();
  return (
    <Screen bg="bg-white" className="px-6 pt-2" footer={
      <div className="px-2">
        <div className="flex flex-col gap-2.5">
          <PrimaryButton onClick={() => nav('/new')}>Create a Party</PrimaryButton>
          <SecondaryButton onClick={() => nav('/join')}>Join with a Code</SecondaryButton>
        </div>
        <p className="mt-3 mb-0 text-center text-[13px] text-sec">No download. No account. Just a party code.</p>
      </div>
    }>
      <div className="flex h-11 items-center">
        <span className="disp text-[26px] tracking-[-1px]">nomi<span className="text-brand">.</span></span>
      </div>
      <div className="relative mx-auto mt-5 h-[320px] max-w-[342px]" aria-hidden="true">
        <div className="absolute top-[34px] left-1"><Poster cuisine="Mexican" price="$" name="Taqueria El Sol" bg="#9C5B3B" fg="#fff" w={176} h={236} rot={-9} big={29} /></div>
        <div className="absolute top-[34px] right-1"><Poster cuisine="Taiwanese" price="$$" name="Bao Down" bg="#1F3A5F" fg="#fff" w={176} h={236} rot={8} big={29} /></div>
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2"><Poster cuisine="Vietnamese" price="$" name="Golden Lotus Pho" bg="#D9C3A0" fg="#1A1A1A" w={180} h={264} rot={0} big={31} shadow /></div>
        <div className="absolute -bottom-3.5 -left-1.5 flex items-end gap-1">
          <div className="bob"><Avatar color="#E8833A" face={0} size={56} host /></div>
          <div className="mb-11"><Bubble text="Yum!" bg="var(--color-brand)" /></div>
        </div>
        <div className="absolute -top-3 -right-1.5 flex flex-row-reverse items-start gap-1">
          <div className="bob" style={{ animationDelay: '0.5s' }}><Avatar color="#D9609B" face={3} size={48} /></div>
          <div className="mt-0.5"><Bubble text="Nope." bg="var(--color-neg)" side="right" /></div>
        </div>
      </div>
      <h1 className="disp mt-[30px] mb-0 text-[40px] leading-[0.98] tracking-[-1.4px]">
        Where are we{' '}
        <span className="inline-block -rotate-3 rounded-[10px] bg-black px-2.5 pb-1 text-white">eating?</span>
      </h1>
      <p className="mt-2.5 mb-4 text-[17px] leading-[23px] text-[#3C3C43]">
        Swipe on restaurants with your friends, play power-ups, and let one place win.
      </p>
    </Screen>
  );
}
