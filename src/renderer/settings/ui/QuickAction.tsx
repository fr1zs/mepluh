import { medalUi } from "../../medal/components";

type QuickActionTarget = { readonly onClick: () => void } | { readonly to: string };

type QuickActionProps = QuickActionTarget & {
    readonly icon: string;
    readonly label: string;
    readonly className?: string;
    readonly disabled?: boolean;
};

export const QuickAction = (props: QuickActionProps) => {
    const { Button, Icon, Link } = medalUi().components;
    const classes = ["w-full justify-start gap-2", props.className].filter(Boolean).join(" ");
    const button = (
        <Button
            variant="secondary"
            size="lg"
            className={classes}
            {...(props.disabled !== undefined ? { disabled: props.disabled } : {})}
            {...("onClick" in props ? { onClick: props.onClick } : {})}
        >
            <Icon shape={props.icon} size={18} />
            <span className="truncate">{props.label}</span>
        </Button>
    );
    return "to" in props ? (
        <Link to={props.to} newWindow={false} className="block w-full">
            {button}
        </Link>
    ) : (
        button
    );
};