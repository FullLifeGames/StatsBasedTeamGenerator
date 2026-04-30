import {useState} from 'react';
import {Check, Copy} from 'lucide-react';

interface CopyImportableButtonProps {
  importable: string;
}

export function CopyImportableButton({importable}: CopyImportableButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyImportable = async (): Promise<void> => {
    await window.navigator.clipboard?.writeText(importable);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <button className="copy-button" type="button" onClick={() => void copyImportable()} aria-label={copied ? 'Copied' : 'Copy importable'}>
      {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
