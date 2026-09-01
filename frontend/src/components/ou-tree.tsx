'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import type { OUNode } from '@/lib/types';
import { ous } from '@/lib/api';

interface OUTreeProps {
    onSelect: (ou: string | null) => void;
    selectedOU: string | null;
}

function OUTreeNode({
    node,
    onSelect,
    selectedOU,
    depth = 0,
}: {
    node: OUNode;
    onSelect: (ou: string | null) => void;
    selectedOU: string | null;
    depth?: number;
}) {
    const [expanded, setExpanded] = useState(depth < 2);
    const isSelected = selectedOU === node.dn;
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="animate-fade-in">
            <button
                onClick={() => {
                    onSelect(isSelected ? null : node.dn);
                    if (hasChildren) setExpanded(!expanded);
                }}
                className={cn(
                    'ou-tree-node w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg',
                    isSelected && 'active',
                )}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
            >
                {hasChildren ? (
                    expanded ? (
                        <ChevronDown size={14} className="text-accent/40 flex-shrink-0" />
                    ) : (
                        <ChevronRight size={14} className="text-accent/40 flex-shrink-0" />
                    )
                ) : (
                    <span className="w-[14px]" />
                )}

                {expanded && hasChildren ? (
                    <FolderOpen size={16} className="text-primary flex-shrink-0" />
                ) : (
                    <Folder size={16} className="text-primary/60 flex-shrink-0" />
                )}

                <span className={cn(
                    'truncate text-left',
                    isSelected ? 'text-primary-dark font-semibold' : 'text-accent/70'
                )}>
                    {node.name}
                </span>
            </button>

            {expanded && hasChildren && (
                <div className="animate-slide-up">
                    {node.children.map((child) => (
                        <OUTreeNode
                            key={child.dn}
                            node={child}
                            onSelect={onSelect}
                            selectedOU={selectedOU}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OUTree({ onSelect, selectedOU }: OUTreeProps) {
    const { t } = useTranslation();
    const [tree, setTree] = useState<OUNode[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTree();
    }, []);

    const loadTree = async () => {
        try {
            setLoading(true);
            const data = await ous.tree();
            setTree(data);
        } catch (error) {
            console.error('Failed to load OU tree:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-border/40 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 bg-surface/30">
                <h3 className="text-xs font-semibold text-accent/60 uppercase tracking-wider">
                    {t('ouTree.title')}
                </h3>
            </div>

            <div className="p-2 max-h-[calc(100vh-240px)] overflow-y-auto">
                {/* All items option */}
                <button
                    onClick={() => onSelect(null)}
                    className={cn(
                        'ou-tree-node w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg mb-1',
                        selectedOU === null && 'active'
                    )}
                >
                    <Folder size={16} className="text-primary flex-shrink-0" />
                    <span className={cn(
                        'truncate',
                        selectedOU === null ? 'text-primary-dark font-semibold' : 'text-accent/70'
                    )}>
                        {t('ouTree.allItems')}
                    </span>
                </button>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : tree.length === 0 ? (
                    <p className="text-xs text-accent/40 text-center py-4">
                        {t('common.noData')}
                    </p>
                ) : (
                    tree.map((node) => (
                        <OUTreeNode
                            key={node.dn}
                            node={node}
                            onSelect={onSelect}
                            selectedOU={selectedOU}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
