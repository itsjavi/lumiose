//! OXVG passes: the default preset when optimising, and the transforms that always run.

use std::path::PathBuf;

use oxvg_ast::parse::roxmltree::parse_with_options;
use oxvg_ast::serialize::Node as _;
use oxvg_ast::visitor::Info;
use oxvg_optimiser::{
    ConvertColors, ConvertStyleToAttrs, Jobs, Method, PrefixIds, RemoveComments, RemoveDoctype,
    RemoveScripts, RemoveTitle, RemoveXMLProcInst, RemoveXlink,
};

use crate::{SvgError, SvgOptions, parse_options, xml_error};

/// `svg` after the OXVG jobs `options` ask for, serialized. Ids and class names get `prefix`.
pub(crate) fn run(svg: &str, prefix: &str, options: &SvgOptions) -> Result<String, SvgError> {
    // roxmltree's error has the position; OXVG's wraps it.
    let document =
        roxmltree::Document::parse_with_options(svg, parse_options()).map_err(|e| xml_error(&e))?;
    crate::emit::svg_root(&document)?;
    // Class names only need a prefix when a `<style>` in the file can match them; otherwise
    // they are hooks for the page's CSS.
    let has_style = document
        .descendants()
        .any(|node| node.is_element() && node.tag_name().name() == "style");
    let jobs = jobs(options, has_style);
    // `inlineStyles` moves `<style>` rules into `style` attributes after `convertStyleToAttrs`
    // has run, so it runs once more.
    let attributes = Jobs {
        convert_style_to_attrs: options.optimize.then(ConvertStyleToAttrs::default),
        ..Jobs::none()
    };
    let optimized = parse_with_options(svg, parse_options(), |root, allocator| {
        let mut info = Info::new(allocator);
        // `prefixIds` names ids `<first path component>__<id>` when no prefix is configured.
        info.path = Some(PathBuf::from(prefix));
        jobs.run(root, &info).map_err(|error| error.to_string())?;
        attributes
            .run(root, &info)
            .map_err(|error| error.to_string())?;
        root.serialize().map_err(|error| error.to_string())
    })
    .map_err(|error| SvgError {
        message: format!("invalid SVG: {error}"),
        position: None,
    })?;
    optimized.map_err(|message| SvgError {
        message: format!("could not optimise the SVG: {message}"),
        position: None,
    })
}

fn jobs(options: &SvgOptions, prefix_class_names: bool) -> Jobs {
    let mut jobs = if options.optimize {
        Jobs {
            convert_style_to_attrs: Some(ConvertStyleToAttrs::default()),
            ..Jobs::default()
        }
    } else {
        Jobs {
            remove_doctype: Some(RemoveDoctype::default()),
            remove_x_m_l_proc_inst: Some(RemoveXMLProcInst::default()),
            remove_comments: Some(RemoveComments::default()),
            ..Jobs::none()
        }
    };
    jobs.remove_scripts = Some(RemoveScripts(true));
    jobs.remove_title = Some(RemoveTitle(true));
    jobs.remove_xlink = Some(RemoveXlink::default());
    jobs.prefix_ids = Some(PrefixIds {
        prefix_class_names,
        ..PrefixIds::default()
    });
    if options.current_color {
        jobs.convert_colors = Some(ConvertColors {
            method: Some(Method::CurrentColor),
        });
    }
    jobs
}
