import { useEffect, useState } from "react";
import { getFabric, loadFabric } from "@/lib/loadFabric";

export function useFabric() {
  const [fabricLoaded, setFabricLoaded] = useState(() => !!getFabric());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (fabricLoaded) return;
    loadFabric()
      .then(() => setFabricLoaded(true))
      .catch(setError);
  }, [fabricLoaded]);

  return { fabricLoaded, fabric: fabricLoaded ? getFabric() : null, error };
}
