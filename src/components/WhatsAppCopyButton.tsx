import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from './ui/button'
import { copyToClipboard } from '../lib/utils'
import { cn } from '../lib/utils'

interface WhatsAppCopyButtonProps {
  label: string
  generate: () => string
  className?: string
  size?: 'default' | 'sm'
}

export function WhatsAppCopyButton({ label, generate, className, size = 'sm' }: WhatsAppCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = generate()
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleCopy}
      className={cn('gap-1.5', className)}
    >
      {copied ? (
        <>
          <Check size={13} className="text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy size={13} />
          {label}
        </>
      )}
    </Button>
  )
}
