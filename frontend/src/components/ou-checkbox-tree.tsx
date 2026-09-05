'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OUNode } from '@/lib/types';

interface OUCheckboxTreeProps {
    tree: OUNode[];
    selected: string[];
    onChange: (selected: string[]) => void;
    disabled?: boolean;
}

function OUCheckboxTreeNode({
    node,
    selected,
    onChange,
    disabled,
    depth = 0,
}: {
    node: OUNode;
    selected: string[];
    onChange: (selected: string[]) => void;
    disabled?: boolean;
    depth?: number;
}) {
    const [expanded, setExpanded] = useState(depth < 1);
    const isSelected = selected.includes(node.dn);
    const hasChildren = node.children && node.children.length > 0;

    const toggle = () => {
        if (isSelected) {
            onChange(selected.filter((dn) => dn !== node.dn));
        } else {
            onChange([...selected, node.dn]);
        }
    };

    return (
        <div className="animate-fade-in">
            <div
                className={cn(
                    'w-full flex items-center gap-2 py-1.5 pr-2 rounded-lg transition-smooth',
                    !disabled && 'hover:bg-surface/80 cursor-pointer'
                )}
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
                onClick={() => !disabled && toggle()}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) setExpanded(!expanded);
                    }}
                    className="flex-shrink-0 text-accent/40 hover:text-accent transition-smooth"
                >
                    {hasChildren ? (
                        expanded ? (
                            <ChevronDown size={14} />
                        ) : (
                            <ChevronRight size={14} />
                        )
                    ) : (
                        <span className="w-[14px] block" />
                    )}
                </button>

                <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={toggle}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded accent-primary flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
                />

                <span className="flex-shrink-0">
                    {expanded && hasChildren ? (
                        <FolderOpen size={16} className="text-primary" />
                    ) : (
                        <Folder size={16} className="text-primary/60" />
                    )}
                </span>

                <span className={cn(
                    'truncate text-sm',
                    isSelected ? 'text-primary-dark font-medium' : 'text-accent/70'
                )}>
                    {node.name}
                </span>
            </div>

            {expanded && hasChildren && (
                <div className="animate-slide-up">
                    {node.children.map((child) => (
                        <OUCheckboxTreeNode
                            key={child.dn}
                            node={child}
                            selected={selected}
                            onChange={onChange}
                            disabled={disabled}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OUCheckboxTree({ tree, selected, onChange, disabled }: OUCheckboxTreeProps) {
    return (
        <div className={cn(
            'bg-white rounded-xl border border-border/40 overflow-hidden',
            disabled && 'opacity-60 pointer-events-none'
        )}>
            <div className="p-2 max-h-64 overflow-y-auto">
                {tree.length === 0 ? (
                    <p className="text-xs text-accent/40 text-center py-4">…</p>
                ) : (
                    tree.map((node) => (
                        <OUCheckboxTreeNode
                            key={node.dn}
                            node={node}
                            selected={selected}
                            onChange={onChange}
                            disabled={disabled}
                        />
                    ))
                )}
            </div>
        </div>
    );
}