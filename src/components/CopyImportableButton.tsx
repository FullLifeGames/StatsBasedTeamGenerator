import {useEffect, useRef, useState} from 'react';
import {Check, Copy} from 'lucide-react';

interface CopyImportableButtonProps {
  importable: string;
}

export function CopyImportableButton({importable}: CopyImportableButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopied(false);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, [importable]);

  useEffect(() => () => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
  }, []);

  const copyImportable = async (): Promise<void> => {
    await window.navigator.clipboard?.writeText(importable);
    setCopied(true);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, 2000);
  };

  return (
    <button className="copy-button" type="button" onClick={() => void copyImportable()} aria-label={copied ? 'Copied' : 'Copy importable'}>
      {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
