import {
  FieldTitle,
  useInput,
  useResourceContext,
  type InputProps,
} from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { Input } from "@/components/ui/input";

/** Time of day ("HH:MM") input; an empty value means "no time". */
export const TimeInput = (
  props: InputProps & { className?: string; helperText?: string | false },
) => {
  const { label, source, helperText, className } = props;
  const resource = useResourceContext(props);
  const { field, id, isRequired } = useInput({
    ...props,
    format: (value: string | null | undefined) => value ?? "",
    parse: (value: string) => value || null,
  });
  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input type="time" step={300} {...field} />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};
