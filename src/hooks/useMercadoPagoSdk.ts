import { useEffect, useState } from 'react';

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

let sdkPromise: Promise<any> | null = null;

function loadSdkScript(): Promise<any> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve(window.MercadoPago);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => resolve(window.MercadoPago);
    script.onerror = () => reject(new Error('Falha ao carregar o SDK do Mercado Pago'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// Loads the Mercado Pago SDK once (shared across every checkout page that
// mounts a Card Payment Brick) and returns a ready `mp` client instance.
export function useMercadoPagoSdk() {
  const [mp, setMp] = useState<any>(null);

  useEffect(() => {
    let active = true;
    loadSdkScript()
      .then((MercadoPago) => {
        if (!active) return;
        const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
        setMp(new MercadoPago(publicKey, { locale: 'pt-BR' }));
      })
      .catch((error) => console.error(error));
    return () => {
      active = false;
    };
  }, []);

  return mp;
}
