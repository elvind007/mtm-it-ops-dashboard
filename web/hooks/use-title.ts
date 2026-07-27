import { create } from "zustand";

type TitleState = {
    title: string | null;
    setTitle: (title: string | null) => void;
};

const useTitle = create<TitleState>((set) => {
    const store = {
        title: null,
        setTitle: (title: string | null) => set({ title }),
    };
    return store;
});

const APP_NAME = "IT Ops Dashboard";

useTitle.subscribe((state) => {
    if (typeof document !== "undefined") {
        document.title = state.title ? `${APP_NAME} | ${state.title}` : APP_NAME;
    }
});

export default useTitle;
