import { useEffect, useState } from "react";

function useIsMaximized() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void window.electronWindow.isMaximized().then((maximized) => {
      if (isMounted) {
        setIsMaximized(maximized);
      }
    });

    const unsubscribe = window.electronWindow.onMaximizedChange(setIsMaximized);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return isMaximized;
}

export { useIsMaximized };
