import { useEffect, useState } from "react";

export interface KeyMap {
  keyValue: string;
  startTime: number;
}

export const useKeyMap = (targetKeys: KeyMap[]) => {
  const [isCapsLockOn, setIsCapsLockOn] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCapsLockOn && targetKeys.some(key => key.keyValue == event.key)) {
        const key = targetKeys.find(key => key.keyValue == event.key);
        if (key) {
          console.log(key.keyValue, key.startTime);
        }
      } else if (event.key == "CapsLock") {
        setIsCapsLockOn(true);
        console.log(targetKeys);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [targetKeys])


  return isCapsLockOn
};