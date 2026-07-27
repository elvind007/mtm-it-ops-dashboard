"use client"

import useTitle from "@/hooks/use-title";
import React, { useEffect } from "react";

interface Props {
    title?: string;
    description?: string;
    children?:  React.ReactNode
}
const AppContent = ({ title, description, children }: Props) => {
    const {setTitle} = useTitle();
    
    useEffect(() => {
        if (title) {
            setTitle(title);
        }
    }, [title, setTitle]);

    return (
        <div className="flex flex-col">
            {title && <div className="font-bold text-lg">{title}</div>}
            {description && <div className="text-muted-foreground text-sm">{description}</div>}
            <div className="mt-5 text-sm">
                {children}
            </div>
        </div>
    );
};

export default AppContent;
