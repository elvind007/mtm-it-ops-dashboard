"use client"
import React from 'react'
import { usePathname } from "next/navigation";
import Link from "next/link";


import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AppCrumb = () => {
  
    const pathname = usePathname();
    const pathArray =pathname.split('/').filter(path => path);
    const asPathArray = pathname.split('/').filter(path => path);
    
    const breadcrumbTitles: { [key: string]: string } = {
        "ai" : "AI",
    };

    return (
        <div className='z-index-999'>
            <div className="overflow-auto xl:max-w-[80vw] max-w-[250px] scrollbar-thin flex flex-nowrap">
                {pathArray.map((path: string, index: number) => {
                    const href = `/${asPathArray.slice(0, index + 1).join('/')}`;
                    const isLast = index === pathArray.length - 1;
                    const isUuid = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(path);
                    const isNumeric = !isNaN(Number(path));
                    const title = breadcrumbTitles[path] ||
                    (isUuid || isNumeric
                      ? 'View'
                      : path
                          .replace(/-/g, ' ')
                          .replace(/^./, (char) => char.toUpperCase()));
                    
                    return (
                        <React.Fragment key={index}>
                            {!isLast ? (
                                <>
                                    <Link href={href} className="whitespace-nowrap">
                                        <Button variant="link" size="sm" className="p-1 text-xs text-gray-500 hover:text-gray-700 flex-shrink-0">
                                        {title}
                                        </Button>
                                    </Link>
                                    <ChevronRight className="w-4 h-4 mt-2 text-gray-500 mx-2 flex-shrink-0" />
                                </>
                            ) : (
                                <Button variant="ghost" size="sm" className="p-1 text-xs whitespace-nowrap text-primary flex-shrink-0">{title}</Button>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
      
    )
}

export default AppCrumb
